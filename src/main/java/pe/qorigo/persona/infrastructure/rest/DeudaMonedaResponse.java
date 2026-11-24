package pe.qorigo.persona.infrastructure.rest;

import java.math.BigDecimal;

public record DeudaMonedaResponse(String moneda, BigDecimal monto) {
}
