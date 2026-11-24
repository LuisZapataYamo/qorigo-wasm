package pe.qorigo.auth.infrastructure.persistence;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import pe.qorigo.auth.application.UsuarioRepository;
import pe.qorigo.auth.domain.Usuario;

import java.util.Optional;

@ApplicationScoped
public class UsuarioPersistenceAdapter implements UsuarioRepository {

    @Inject
    EntityManager em;

    @Inject
    AuthPersistenceMapper mapper;

    @Override
    public Optional<Usuario> buscarPorEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return em.createQuery("select u from UsuarioEntity u where lower(u.emailLogin) = lower(:email)", UsuarioEntity.class)
                .setParameter("email", email.trim())
                .getResultStream()
                .findFirst()
                .map(mapper::aDominio);
    }

    @Override
    public Optional<Usuario> buscarPorId(Long idUsuario) {
        return Optional.ofNullable(em.find(UsuarioEntity.class, idUsuario)).map(mapper::aDominio);
    }

    @Override
    public Optional<Usuario> buscarPorPersona(Long idPersona) {
        return em.createQuery("select u from UsuarioEntity u where u.idPersona = :idPersona", UsuarioEntity.class)
                .setParameter("idPersona", idPersona)
                .getResultStream()
                .findFirst()
                .map(mapper::aDominio);
    }

    @Override
    public boolean existeEmail(String email) {
        Long cantidad = em.createQuery("select count(u) from UsuarioEntity u where lower(u.emailLogin) = lower(:email)", Long.class)
                .setParameter("email", email == null ? "" : email.trim())
                .getSingleResult();
        return cantidad > 0;
    }

    @Override
    public Usuario guardar(Usuario usuario) {
        UsuarioEntity entity = mapper.aEntidad(usuario);
        if (entity.getIdUsuario() == null) {
            em.persist(entity);
        } else {
            entity = em.merge(entity);
        }
        em.flush();
        return mapper.aDominio(entity);
    }

    @Override
    public void actualizarPasswordHash(Long idUsuario, String passwordHash) {
        UsuarioEntity entity = em.find(UsuarioEntity.class, idUsuario);
        if (entity != null) {
            entity.setPasswordHash(passwordHash);
        }
    }

    @Override
    public void actualizarActivo(Long idUsuario, boolean activo) {
        UsuarioEntity entity = em.find(UsuarioEntity.class, idUsuario);
        if (entity != null) {
            entity.setActivo(activo);
        }
    }
}
