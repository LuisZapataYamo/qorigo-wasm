package pe.qorigo.shared.application;

/**
 * Puerto de auditoría. Registra quién, cuándo, qué cambió y los valores
 * anterior/nuevo.
 */
public interface AuditoriaPort {

    void registrar(String entidad, Long idEntidad, String accion, Object antes, Object despues);
}
