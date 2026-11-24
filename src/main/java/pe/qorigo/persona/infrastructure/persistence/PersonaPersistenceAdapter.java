package pe.qorigo.persona.infrastructure.persistence;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import pe.qorigo.persona.application.PersonaRepository;
import pe.qorigo.persona.domain.Persona;

import java.util.Optional;

@ApplicationScoped
public class PersonaPersistenceAdapter implements PersonaRepository {

    @Inject
    EntityManager em;

    @Inject
    PersonaPersistenceMapper mapper;

    @Override
    public Optional<Persona> buscarPorId(Long idPersona) {
        return Optional.ofNullable(em.find(PersonaEntity.class, idPersona)).map(mapper::aDominio);
    }

    @Override
    public Optional<Persona> buscarPorDocumento(String documento) {
        if (documento == null || documento.isBlank()) {
            return Optional.empty();
        }
        return em.createQuery("select p from PersonaEntity p where p.documento = :documento", PersonaEntity.class)
                .setParameter("documento", documento.trim())
                .getResultStream()
                .findFirst()
                .map(mapper::aDominio);
    }

    @Override
    public Persona guardar(Persona persona) {
        PersonaEntity entity = mapper.aEntidad(persona);
        if (entity.getIdPersona() == null) {
            em.persist(entity);
        } else {
            entity = em.merge(entity);
        }
        em.flush();
        return mapper.aDominio(entity);
    }
}
