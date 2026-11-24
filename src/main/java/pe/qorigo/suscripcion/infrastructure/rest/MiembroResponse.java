package pe.qorigo.suscripcion.infrastructure.rest;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record MiembroResponse(
        Long idMiembro,
        Long idSuscripcion,
        Long idPersona,
        String nombres,
        String apellidos,
        String documento,
        BigDecimal montoAcordado,
        boolean esPlazaPropia,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        String estado,
        Instant creadoEn
) {
}
