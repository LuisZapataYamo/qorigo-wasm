package pe.qorigo.shared.domain;

import java.util.Map;

public class ConflictoException extends NegocioException {

    private final Map<String, String> detalles;

    public ConflictoException(String codigo, String mensaje) {
        this(codigo, mensaje, Map.of());
    }

    public ConflictoException(String codigo, String mensaje, Map<String, String> detalles) {
        super(codigo, mensaje);
        this.detalles = detalles == null ? Map.of() : Map.copyOf(detalles);
    }

    public ConflictoException(String mensaje) {
        this("CONFLICTO", mensaje, Map.of());
    }

    public Map<String, String> detalles() {
        return detalles;
    }
}
