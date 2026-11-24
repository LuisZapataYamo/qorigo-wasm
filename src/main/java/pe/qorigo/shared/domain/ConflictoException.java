package pe.qorigo.shared.domain;

public class ConflictoException extends NegocioException {

    public ConflictoException(String codigo, String mensaje) {
        super(codigo, mensaje);
    }

    public ConflictoException(String mensaje) {
        super("CONFLICTO", mensaje);
    }
}
