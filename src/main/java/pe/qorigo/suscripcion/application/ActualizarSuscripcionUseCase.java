package pe.qorigo.suscripcion.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.domain.Dinero;
import pe.qorigo.shared.domain.NoEncontradoException;
import pe.qorigo.shared.domain.ValidacionException;
import pe.qorigo.suscripcion.domain.EstadoSuscripcion;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.math.BigDecimal;

@ApplicationScoped
public class ActualizarSuscripcionUseCase {

    @Inject
    SuscripcionRepository suscripciones;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public SuscripcionDetalle ejecutar(Long idSuscripcion, ActualizarSuscripcionCommand command) {
        Suscripcion actual = suscripciones.buscarPorId(idSuscripcion)
                .orElseThrow(() -> new NoEncontradoException("Suscripción", idSuscripcion));
        ResumenMiembros resumen = suscripciones.resumenMiembros(idSuscripcion);

        String nombre = command.nombre() == null ? actual.nombre() : nombre(command.nombre());
        BigDecimal costo = command.costo() == null ? actual.costo() : costo(command.costo());
        int capacidad = command.capacidad() == null
                ? actual.capacidad()
                : capacidad(command.capacidad(), resumen.activos());
        int diaCobro = command.diaCobro() == null ? actual.diaCobro() : diaCobro(command.diaCobro());
        EstadoSuscripcion estado = command.estado() == null
                ? actual.estado()
                : EstadoSuscripcion.desde(command.estado());

        Suscripcion actualizada = new Suscripcion(
                actual.idSuscripcion(),
                actual.idPlataforma(),
                actual.moneda(),
                nombre,
                costo,
                actual.periodicidad(),
                capacidad,
                diaCobro,
                actual.fechaInicio(),
                estado,
                actual.creadoEn());

        if (actualizada.equals(actual)) {
            return SuscripcionDetalle.de(actual, resumen);
        }

        Suscripcion guardada = suscripciones.guardar(actualizada);
        auditoria.registrar("SUSCRIPCION", idSuscripcion, accion(actual, guardada), actual, guardada);
        return SuscripcionDetalle.de(guardada, resumen);
    }

    private String accion(Suscripcion antes, Suscripcion despues) {
        if (antes.estado() != despues.estado()) {
            return "CAMBIAR_ESTADO";
        }
        if (antes.costo().compareTo(despues.costo()) != 0) {
            return "ACTUALIZAR_COSTO";
        }
        return "ACTUALIZAR";
    }

    private String nombre(String valor) {
        if (valor.isBlank()) {
            throw new ValidacionException("nombre", "El nombre es obligatorio");
        }
        return valor.trim();
    }

    private BigDecimal costo(BigDecimal valor) {
        if (valor.signum() <= 0) {
            throw new ValidacionException("costo", "El costo debe ser mayor que 0");
        }
        return Dinero.normalizar(valor);
    }

    private int capacidad(Integer valor, long ocupadas) {
        if (valor < 1) {
            throw new ValidacionException("capacidad", "La capacidad debe ser mayor o igual a 1");
        }
        if (valor < ocupadas) {
            throw new ValidacionException("capacidad",
                    "La capacidad no puede ser menor a las plazas ocupadas (" + ocupadas + ")");
        }
        return valor;
    }

    private int diaCobro(Integer valor) {
        if (valor < 1 || valor > 31) {
            throw new ValidacionException("diaCobro", "El día de cobro debe estar entre 1 y 31");
        }
        return valor;
    }
}
