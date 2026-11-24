package pe.qorigo.suscripcion.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.catalogo.application.CatalogoRepository;
import pe.qorigo.catalogo.domain.Plataforma;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.application.Reloj;
import pe.qorigo.shared.domain.Dinero;
import pe.qorigo.shared.domain.NoEncontradoException;
import pe.qorigo.shared.domain.ValidacionException;
import pe.qorigo.suscripcion.domain.EstadoSuscripcion;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.math.BigDecimal;
import java.util.Locale;

@ApplicationScoped
public class CrearSuscripcionUseCase {

    @Inject
    SuscripcionRepository suscripciones;

    @Inject
    CatalogoRepository catalogo;

    @Inject
    Reloj reloj;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public SuscripcionDetalle ejecutar(CrearSuscripcionCommand command) {
        if (command.idPlataforma() == null) {
            throw new ValidacionException("idPlataforma", "Debes seleccionar una plataforma");
        }
        Plataforma plataforma = catalogo.buscarPlataforma(command.idPlataforma())
                .orElseThrow(() -> new NoEncontradoException("Plataforma", command.idPlataforma()));
        if (!plataforma.activo()) {
            throw new ValidacionException("idPlataforma", "La plataforma seleccionada está inactiva");
        }

        String nombre = obligatorio(command.nombre());
        String moneda = moneda(command.moneda());
        BigDecimal costo = costo(command.costo());
        int capacidad = capacidad(command.capacidad());
        int diaCobro = diaCobro(command.diaCobro());
        if (command.fechaInicio() == null) {
            throw new ValidacionException("fechaInicio", "La fecha de inicio es obligatoria");
        }

        Suscripcion suscripcion = new Suscripcion(
                null,
                command.idPlataforma(),
                moneda,
                nombre,
                costo,
                "MENSUAL",
                capacidad,
                diaCobro,
                command.fechaInicio(),
                EstadoSuscripcion.ACTIVA,
                reloj.ahora());

        Suscripcion guardada = suscripciones.guardar(suscripcion);
        auditoria.registrar("SUSCRIPCION", guardada.idSuscripcion(), "CREAR", null, guardada);
        return SuscripcionDetalle.de(guardada, ResumenMiembros.vacio());
    }

    private String obligatorio(String valor) {
        if (valor == null || valor.isBlank()) {
            throw new ValidacionException("nombre", "El nombre es obligatorio");
        }
        return valor.trim();
    }

    private String moneda(String valor) {
        if (valor == null || valor.isBlank()) {
            throw new ValidacionException("moneda", "La moneda es obligatoria");
        }
        String moneda = valor.trim().toUpperCase(Locale.ROOT);
        if (moneda.length() != 3) {
            throw new ValidacionException("moneda", "La moneda debe tener 3 letras");
        }
        if (!catalogo.existeMoneda(moneda)) {
            throw new ValidacionException("moneda", "La moneda no existe");
        }
        return moneda;
    }

    private BigDecimal costo(BigDecimal valor) {
        if (valor == null || valor.signum() <= 0) {
            throw new ValidacionException("costo", "El costo debe ser mayor que 0");
        }
        return Dinero.normalizar(valor);
    }

    private int capacidad(Integer valor) {
        if (valor == null || valor < 1) {
            throw new ValidacionException("capacidad", "La capacidad debe ser mayor o igual a 1");
        }
        return valor;
    }

    private int diaCobro(Integer valor) {
        if (valor == null || valor < 1 || valor > 31) {
            throw new ValidacionException("diaCobro", "El día de cobro debe estar entre 1 y 31");
        }
        return valor;
    }
}
