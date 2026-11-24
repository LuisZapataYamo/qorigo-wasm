package pe.qorigo.suscripcion.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.persona.application.PersonaRepository;
import pe.qorigo.persona.application.RegistrarPersonaCommand;
import pe.qorigo.persona.application.RegistrarPersonaUseCase;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.application.Reloj;
import pe.qorigo.shared.domain.ConflictoException;
import pe.qorigo.shared.domain.Dinero;
import pe.qorigo.shared.domain.NoEncontradoException;
import pe.qorigo.shared.domain.ReglaNegocioException;
import pe.qorigo.shared.domain.ValidacionException;
import pe.qorigo.suscripcion.domain.EstadoMiembro;
import pe.qorigo.suscripcion.domain.MiembroSuscripcion;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.math.BigDecimal;
import java.time.LocalDate;

@ApplicationScoped
public class AgregarMiembroUseCase {

    @Inject
    SuscripcionRepository suscripciones;

    @Inject
    MiembroSuscripcionRepository miembros;

    @Inject
    PersonaRepository personas;

    @Inject
    RegistrarPersonaUseCase registrarPersona;

    @Inject
    Reloj reloj;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public MiembroDetalle ejecutar(Long idSuscripcion, AgregarMiembroCommand command) {
        // RN-S01: la fila bloqueada serializa las altas concurrentes de la suscripción.
        Suscripcion suscripcion = suscripciones.bloquearPorId(idSuscripcion)
                .orElseThrow(() -> new NoEncontradoException("Suscripción", idSuscripcion));
        if (!suscripcion.activa()) {
            throw new ReglaNegocioException("SUSCRIPCION_NO_ACTIVA",
                    "La suscripción no está activa; no se pueden agregar miembros");
        }

        boolean plazaPropia = Boolean.TRUE.equals(command.esPlazaPropia());
        BigDecimal monto = montoAcordado(command.montoAcordado(), plazaPropia);
        Persona persona = resolverPersona(command);

        if (miembros.existeActivo(idSuscripcion, persona.idPersona())) {
            throw new ConflictoException("MIEMBRO_DUPLICADO",
                    "La persona ya tiene una membresía activa en esta suscripción");
        }

        ResumenMiembros resumen = suscripciones.resumenMiembros(idSuscripcion);
        if (resumen.activos() >= suscripcion.capacidad()) {
            throw new ConflictoException("SIN_PLAZAS", "No hay plazas libres en la suscripción");
        }

        LocalDate fechaInicio = command.fechaInicio() == null ? reloj.hoy() : command.fechaInicio();
        MiembroSuscripcion miembro = new MiembroSuscripcion(
                null,
                idSuscripcion,
                persona.idPersona(),
                monto,
                plazaPropia,
                fechaInicio,
                null,
                EstadoMiembro.ACTIVO,
                reloj.ahora());

        MiembroSuscripcion guardado = miembros.guardar(miembro);
        auditoria.registrar("MIEMBRO_SUSCRIPCION", guardado.idMiembro(), "CREAR", null, guardado);
        return new MiembroDetalle(guardado, persona.nombres(), persona.apellidos(), persona.documento());
    }

    private Persona resolverPersona(AgregarMiembroCommand command) {
        if (command.idPersona() != null && command.personaNueva() != null) {
            throw new ValidacionException("idPersona",
                    "Indica una persona existente o los datos de una nueva, no ambas");
        }
        if (command.idPersona() != null) {
            return personas.buscarPorId(command.idPersona())
                    .orElseThrow(() -> new NoEncontradoException("Persona", command.idPersona()));
        }
        if (command.personaNueva() != null) {
            PersonaNuevaCommand nueva = command.personaNueva();
            return registrarPersona.ejecutar(new RegistrarPersonaCommand(
                    nueva.nombres(),
                    nueva.apellidos(),
                    nueva.documento(),
                    nueva.telefono(),
                    nueva.email(),
                    nueva.direccion(),
                    command.confirmarDuplicado()));
        }
        throw new ValidacionException("idPersona",
                "Debes indicar una persona existente o los datos de una nueva");
    }

    private BigDecimal montoAcordado(BigDecimal monto, boolean plazaPropia) {
        if (plazaPropia) {
            if (monto != null && monto.signum() != 0) {
                throw new ValidacionException("montoAcordado", "La plaza propia debe tener monto 0");
            }
            return Dinero.cero();
        }
        if (monto == null || monto.signum() <= 0) {
            throw new ValidacionException("montoAcordado", "El monto acordado debe ser mayor que 0");
        }
        return Dinero.normalizar(monto);
    }
}
