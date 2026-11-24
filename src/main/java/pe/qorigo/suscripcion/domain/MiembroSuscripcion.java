package pe.qorigo.suscripcion.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record MiembroSuscripcion(
        Long idMiembro,
        Long idSuscripcion,
        Long idPersona,
        BigDecimal montoAcordado,
        boolean esPlazaPropia,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        EstadoMiembro estado,
        Instant creadoEn
) {
    public boolean activo() {
        return estado != null && estado.activo();
    }
}
