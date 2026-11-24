package pe.qorigo.suscripcion.infrastructure.rest;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record SuscripcionResponse(
        Long idSuscripcion,
        Long idPlataforma,
        String nombre,
        String moneda,
        BigDecimal costo,
        String periodicidad,
        int capacidad,
        int diaCobro,
        LocalDate fechaInicio,
        String estado,
        int plazasOcupadas,
        int plazasLibres,
        BigDecimal costoPorPlaza,
        BigDecimal cobertura,
        boolean alertaDeficit,
        Instant creadoEn
) {
}
