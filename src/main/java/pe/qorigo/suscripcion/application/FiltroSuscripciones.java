package pe.qorigo.suscripcion.application;

import pe.qorigo.suscripcion.domain.EstadoSuscripcion;

public record FiltroSuscripciones(
        String texto,
        EstadoSuscripcion estado,
        Long idPlataforma,
        int pagina,
        int tamano
) {
    public int desplazamiento() {
        return (pagina - 1) * tamano;
    }
}
