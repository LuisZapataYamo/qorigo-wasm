package pe.qorigo.shared.domain;

public class NoAutorizadoException extends NegocioException {

    public NoAutorizadoException(String mensaje) {
        super("NO_AUTORIZADO", mensaje);
    }
}
