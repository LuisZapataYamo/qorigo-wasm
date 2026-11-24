package pe.qorigo.auth.infrastructure.persistence;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import pe.qorigo.auth.application.RecuperacionPasswordRepository;
import pe.qorigo.auth.domain.RecuperacionPassword;

import java.util.Optional;

@ApplicationScoped
public class RecuperacionPasswordPersistenceAdapter implements RecuperacionPasswordRepository {

    @Inject
    EntityManager em;

    @Inject
    AuthPersistenceMapper mapper;

    @Override
    public RecuperacionPassword guardar(RecuperacionPassword recuperacion) {
        RecuperacionPasswordEntity entity = mapper.aEntidad(recuperacion);
        if (entity.getIdRecuperacion() == null) {
            em.persist(entity);
        } else {
            entity = em.merge(entity);
        }
        em.flush();
        return mapper.aDominio(entity);
    }

    @Override
    public Optional<RecuperacionPassword> buscarPorTokenHash(String tokenHash) {
        return em.createQuery("select r from RecuperacionPasswordEntity r where r.tokenHash = :hash", RecuperacionPasswordEntity.class)
                .setParameter("hash", tokenHash)
                .getResultStream()
                .findFirst()
                .map(mapper::aDominio);
    }

    @Override
    public void marcarUsado(Long idRecuperacion) {
        RecuperacionPasswordEntity entity = em.find(RecuperacionPasswordEntity.class, idRecuperacion);
        if (entity != null) {
            entity.setUsado(true);
        }
    }

    @Override
    public void invalidarPendientes(Long idUsuario) {
        em.createQuery("update RecuperacionPasswordEntity r set r.usado = true where r.idUsuario = :id and r.usado = false")
                .setParameter("id", idUsuario)
                .executeUpdate();
    }
}
