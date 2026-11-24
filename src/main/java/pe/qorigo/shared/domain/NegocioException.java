package pe.qorigo.shared.domain;

/**
 * Error de negocio controlado. La capa REST lo traduce a un código HTTP.
 */
public abstract class NegocioException extends RuntimeException {

    private final String codigo;

    protected NegocioException(String codigo, String mensaje) {
        super(mensaje);
        this.codigo = codigo;
    }

    public String codigo() {
        return codigo;
    }
}
