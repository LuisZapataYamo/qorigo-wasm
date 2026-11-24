package pe.qorigo.suscripcion.application;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CrearSuscripcionCommand(
        Long idPlataforma,
        String nombre,
        BigDecimal costo,
        String moneda,
        Integer capacidad,
        Integer diaCobro,
        LocalDate fechaInicio
) {
}
