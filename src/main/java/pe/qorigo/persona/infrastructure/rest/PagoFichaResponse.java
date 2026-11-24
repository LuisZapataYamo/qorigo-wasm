package pe.qorigo.persona.infrastructure.rest;

import java.math.BigDecimal;
import java.time.Instant;

public record PagoFichaResponse(
        Long idPago,
        Instant fechaPago,
        BigDecimal monto,
        String moneda,
        String metodoPago,
        String estado
) {
}
