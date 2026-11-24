package pe.qorigo.persona.application;

import java.util.List;

public record FichaPersona(
        pe.qorigo.persona.domain.Persona persona,
        List<SuscripcionDePersona> suscripciones,
        List<PrestamoDePersona> prestamos,
        List<DeudaPorMoneda> deudaPorMoneda,
        List<PagoReciente> pagosRecientes
) {
}
