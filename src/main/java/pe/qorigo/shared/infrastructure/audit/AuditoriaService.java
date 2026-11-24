package pe.qorigo.shared.infrastructure.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.Arc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.application.CurrentUser;
import pe.qorigo.shared.application.Reloj;

@ApplicationScoped
public class AuditoriaService implements AuditoriaPort {

    @Inject
    EntityManager em;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    Reloj reloj;

    @Inject
    Instance<CurrentUser> currentUser;

    @Override
    @Transactional
    public void registrar(String entidad, Long idEntidad, String accion, Object antes, Object despues) {
        AuditoriaEntity entity = new AuditoriaEntity();
        entity.setIdUsuario(usuarioActual());
        entity.setEntidad(entidad);
        entity.setIdEntidad(idEntidad);
        entity.setAccion(accion);
        entity.setAntes(serializar(antes));
        entity.setDespues(serializar(despues));
        entity.setCreadoEn(reloj.ahora());
        em.persist(entity);
    }

    private Long usuarioActual() {
        try {
            if (!Arc.container().requestContext().isActive()) {
                return null;
            }
            CurrentUser usuario = currentUser.get();
            return usuario.idUsuario();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private String serializar(Object valor) {
        if (valor == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(valor);
        } catch (JsonProcessingException e) {
            return String.valueOf(valor);
        }
    }
}
