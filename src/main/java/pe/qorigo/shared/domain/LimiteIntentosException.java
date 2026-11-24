package pe.qorigo.shared.domain;

public class LimiteIntentosException extends NegocioException {

    public LimiteIntentosException(String mensaje) {
        super("DEMASIADOS_INTENTOS", mensaje);
    }
}
