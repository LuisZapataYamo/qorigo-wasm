package pe.qorigo.shared.domain;

public class ProhibidoException extends NegocioException {

    public ProhibidoException(String mensaje) {
        super("PROHIBIDO", mensaje);
    }
}
