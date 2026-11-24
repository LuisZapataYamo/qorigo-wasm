package pe.qorigo.suscripcion.infrastructure.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AgregarMiembroRequest(
        Long idPersona,
        @Valid PersonaNuevaRequest persona,
        @Digits(integer = 10, fraction = 2) BigDecimal montoAcordado,
        Boolean esPlazaPropia,
        LocalDate fechaInicio,
        Boolean confirmarDuplicado
) {
    public boolean confirmaDuplicado() {
        return Boolean.TRUE.equals(confirmarDuplicado);
    }
}
