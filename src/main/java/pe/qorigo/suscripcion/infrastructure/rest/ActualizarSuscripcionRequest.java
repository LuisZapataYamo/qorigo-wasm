package pe.qorigo.suscripcion.infrastructure.rest;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ActualizarSuscripcionRequest(
        @Size(max = 150) String nombre,
        @Digits(integer = 10, fraction = 2) BigDecimal costo,
        Integer capacidad,
        @Min(1) @Max(31) Integer diaCobro,
        @Pattern(regexp = "ACTIVA|SUSPENDIDA|CANCELADA",
                message = "El estado debe ser ACTIVA, SUSPENDIDA o CANCELADA") String estado
) {
}
