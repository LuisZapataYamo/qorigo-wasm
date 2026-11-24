package pe.qorigo.shared.domain;

import java.util.Map;

public class ValidacionException extends NegocioException {

    private final Map<String, String> detalles;

    public ValidacionException(String campo, String mensaje) {
        this("VALIDACION", mensaje, Map.of(campo, mensaje));
    }

    public ValidacionException(String mensaje) {
        this("VALIDACION", mensaje, Map.of());
    }

    public ValidacionException(String codigo, String mensaje, Map<String, String> detalles) {
        super(codigo, mensaje);
        this.detalles = detalles == null ? Map.of() : Map.copyOf(detalles);
    }

    public Map<String, String> detalles() {
        return detalles;
    }
}
