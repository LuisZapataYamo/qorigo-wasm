package pe.qorigo.persona.infrastructure.rest;

import java.util.List;

public record FichaPersonaResponse(
        PersonaResponse persona,
        List<SuscripcionFichaResponse> suscripciones,
        List<PrestamoFichaResponse> prestamos,
        List<DeudaMonedaResponse> deudaPorMoneda,
        List<PagoFichaResponse> pagosRecientes
) {
}
