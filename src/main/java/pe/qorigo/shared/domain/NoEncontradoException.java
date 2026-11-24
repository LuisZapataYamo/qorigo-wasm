package pe.qorigo.shared.domain;

public class NoEncontradoException extends NegocioException {

    public NoEncontradoException(String recurso, Object id) {
        super("NO_ENCONTRADO", recurso + " no encontrado: " + id);
    }

    public NoEncontradoException(String mensaje) {
        super("NO_ENCONTRADO", mensaje);
    }
}
