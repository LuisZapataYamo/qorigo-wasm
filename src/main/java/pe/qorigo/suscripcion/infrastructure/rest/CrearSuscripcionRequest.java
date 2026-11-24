package pe.qorigo.suscripcion.infrastructure.rest;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CrearSuscripcionRequest(
        @NotNull Long idPlataforma,
        @NotBlank @Size(max = 150) String nombre,
        @NotNull @Digits(integer = 10, fraction = 2) BigDecimal costo,
        @NotBlank @Pattern(regexp = "[A-Za-z]{3}", message = "La moneda debe tener 3 letras") String moneda,
        @NotNull Integer capacidad,
        @NotNull @Min(1) @Max(31) Integer diaCobro,
        @NotNull LocalDate fechaInicio
) {
}
