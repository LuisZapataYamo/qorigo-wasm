package pe.qorigo.catalogo.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.domain.ValidacionException;

import java.util.LinkedHashMap;
import java.util.Map;

@ApplicationScoped
public class ActualizarConfiguracionUseCase {

    @Inject
    CatalogoRepository catalogo;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public Map<String, String> ejecutar(Map<String, String> cambios) {
        if (cambios == null || cambios.isEmpty()) {
            throw new ValidacionException("configuracion", "Debes enviar al menos una clave");
        }
        Map<String, String> valores = new LinkedHashMap<>();
        for (Map.Entry<String, String> cambio : cambios.entrySet()) {
            String clave = cambio.getKey() == null ? "" : cambio.getKey().trim();
            String valor = cambio.getValue() == null ? "" : cambio.getValue().trim();
            if (clave.isEmpty() || clave.length() > 60) {
                throw new ValidacionException("clave", "La clave es obligatoria y admite hasta 60 caracteres");
            }
            if (valor.length() > 250) {
                throw new ValidacionException("valor", "El valor admite hasta 250 caracteres");
            }
            valores.put(clave, valor);
        }

        Map<String, String> antes = catalogo.configuracion();
        catalogo.actualizarConfiguracion(valores);
        Map<String, String> despues = catalogo.configuracion();
        auditoria.registrar("CONFIGURACION", null, "ACTUALIZAR", antes, despues);
        return despues;
    }
}
