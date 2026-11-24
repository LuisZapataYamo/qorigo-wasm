package pe.qorigo.persona.infrastructure.rest;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SuscripcionFichaResponse(
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
