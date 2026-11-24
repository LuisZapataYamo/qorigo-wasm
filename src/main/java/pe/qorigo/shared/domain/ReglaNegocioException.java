package pe.qorigo.shared.domain;

public class ReglaNegocioException extends NegocioException {

    public ReglaNegocioException(String codigo, String mensaje) {
        super(codigo, mensaje);
    }

    public ReglaNegocioException(String mensaje) {
        super("REGLA_NEGOCIO", mensaje);
    }
}
