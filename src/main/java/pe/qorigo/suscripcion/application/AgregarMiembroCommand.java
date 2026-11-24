package pe.qorigo.suscripcion.application;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AgregarMiembroCommand(
        Long idPersona,
        PersonaNuevaCommand personaNueva,
        BigDecimal montoAcordado,
        Boolean esPlazaPropia,
        LocalDate fechaInicio,
        boolean confirmarDuplicado
) {
}
