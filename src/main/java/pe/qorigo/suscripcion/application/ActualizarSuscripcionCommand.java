package pe.qorigo.suscripcion.application;

import java.math.BigDecimal;

public record ActualizarSuscripcionCommand(
        String nombre,
        BigDecimal costo,
        Integer capacidad,
        Integer diaCobro,
        String estado
) {
}
