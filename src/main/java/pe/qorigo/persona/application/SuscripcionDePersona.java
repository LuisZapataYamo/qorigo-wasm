package pe.qorigo.persona.application;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SuscripcionDePersona(
        Long idSuscripcion,
        String nombre,
        String plataforma,
        String moneda,
        String estadoMiembro,
        BigDecimal montoAcordado,
        boolean esPlazaPropia,
        LocalDate fechaInicio
) {
}
