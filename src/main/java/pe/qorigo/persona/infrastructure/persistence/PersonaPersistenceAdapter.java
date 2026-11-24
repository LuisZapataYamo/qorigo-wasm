package pe.qorigo.persona.infrastructure.persistence;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import pe.qorigo.persona.application.FiltroPersonas;
import pe.qorigo.persona.application.PersonaRepository;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.Pagina;

import java.util.List;
import java.util.Locale;
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
    public List<Persona> buscarSimilares(String nombreNormalizado) {
        if (nombreNormalizado == null || nombreNormalizado.isBlank()) {
            return List.of();
        }
        return mapper.aDominio(em.createQuery(
                        "select p from PersonaEntity p " +
                                "where p.nombreNormalizado = :nombre " +
                                "or p.nombreNormalizado like concat('%', :nombre, '%') " +
                                "or :nombre like concat('%', p.nombreNormalizado, '%')",
                        PersonaEntity.class)
                .setParameter("nombre", nombreNormalizado)
                .setMaxResults(10)
                .getResultList());
    }

    @Override
    public Pagina<Persona> buscar(FiltroPersonas filtro) {
        String condiciones = condiciones(filtro);
        String orden = " order by p.apellidos, p.nombres, p.idPersona";

        Query consulta = em.createQuery("select p from PersonaEntity p where 1 = 1" + condiciones + orden,
                PersonaEntity.class);
        Query conteo = em.createQuery("select count(p) from PersonaEntity p where 1 = 1" + condiciones,
                Long.class);
        aplicarParametros(consulta, filtro);
        aplicarParametros(conteo, filtro);

        @SuppressWarnings("unchecked")
        List<PersonaEntity> entidades = consulta
                .setFirstResult(filtro.desplazamiento())
                .setMaxResults(filtro.tamano())
                .getResultList();
        long total = (Long) conteo.getSingleResult();
        return Pagina.de(mapper.aDominio(entidades), filtro.pagina(), filtro.tamano(), total);
    }

    private String condiciones(FiltroPersonas filtro) {
        StringBuilder condiciones = new StringBuilder();
        if (filtro.activo() != null) {
            condiciones.append(" and p.activo = :activo");
        }
        if (filtro.texto() != null) {
            condiciones.append(" and (p.nombreNormalizado like :nombreLike")
                    .append(" or lower(p.documento) like :textoLike")
                    .append(" or lower(p.email) like :textoLike)");
        }
        return condiciones.toString();
    }

    private void aplicarParametros(Query query, FiltroPersonas filtro) {
        if (filtro.activo() != null) {
            query.setParameter("activo", filtro.activo());
        }
        if (filtro.texto() != null) {
            query.setParameter("nombreLike", "%" + filtro.nombreNormalizado() + "%");
            query.setParameter("textoLike", "%" + filtro.texto().toLowerCase(Locale.ROOT) + "%");
        }
    }

    @Override
    public boolean tieneMovimientos(Long idPersona) {
        Number total = (Number) em.createNativeQuery("""
                        select (select count(*) from miembro_suscripcion where id_persona = ?1)
                             + (select count(*) from prestamo where id_persona = ?1)
                             + (select count(*) from pago where id_persona = ?1)
                        """)
                .setParameter(1, idPersona)
                .getSingleResult();
        return total.longValue() > 0;
    }

    @Override
    public boolean tieneUsuario(Long idPersona) {
        Number total = (Number) em.createNativeQuery("select count(*) from usuario where id_persona = ?1")
                .setParameter(1, idPersona)
                .getSingleResult();
        return total.longValue() > 0;
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

    @Override
    public void eliminar(Long idPersona) {
        PersonaEntity entity = em.find(PersonaEntity.class, idPersona);
        if (entity != null) {
            em.remove(entity);
        }
    }
}
