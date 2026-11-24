package pe.qorigo.persona.application;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PrestamoDePersona(
        Long idPrestamo,
        String moneda,
        BigDecimal capital,
        BigDecimal saldoPendiente,
        String estado,
        LocalDate fechaPrestamo
) {
}
