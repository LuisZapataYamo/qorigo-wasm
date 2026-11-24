package pe.qorigo.persona.infrastructure.rest;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PrestamoFichaResponse(
        Long idPrestamo,
        String moneda,
        BigDecimal capital,
        BigDecimal saldoPendiente,
        String estado,
        LocalDate fechaPrestamo
) {
}
