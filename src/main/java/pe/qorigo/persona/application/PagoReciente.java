package pe.qorigo.persona.application;

import java.math.BigDecimal;
import java.time.Instant;

public record PagoReciente(
        Long idPago,
        Instant fechaPago,
        BigDecimal monto,
        String moneda,
        String metodoPago,
        String estado
) {
}
