package pe.qorigo.suscripcion.infrastructure.persistence;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import pe.qorigo.persona.infrastructure.persistence.PersonaEntity;
import pe.qorigo.suscripcion.application.MiembroDetalle;
import pe.qorigo.suscripcion.application.MiembroSuscripcionRepository;
import pe.qorigo.suscripcion.domain.MiembroSuscripcion;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class MiembroSuscripcionPersistenceAdapter implements MiembroSuscripcionRepository {

    @Inject
    EntityManager em;

    @Inject
    MiembroSuscripcionPersistenceMapper mapper;

    @Override
    public MiembroSuscripcion guardar(MiembroSuscripcion miembro) {
        MiembroSuscripcionEntity entity = mapper.aEntidad(miembro);
        if (entity.getIdMiembro() == null) {
            em.persist(entity);
        } else {
            entity = em.merge(entity);
        }
        em.flush();
        return mapper.aDominio(entity);
    }

    @Override
    public boolean existeActivo(Long idSuscripcion, Long idPersona) {
        Long total = em.createQuery("""
                        select count(m) from MiembroSuscripcionEntity m
                        where m.idSuscripcion = :idSuscripcion
                          and m.idPersona = :idPersona
                          and m.estado = 'ACTIVO'
                        """, Long.class)
                .setParameter("idSuscripcion", idSuscripcion)
                .setParameter("idPersona", idPersona)
                .getSingleResult();
        return total > 0;
    }

    @Override
    public List<MiembroDetalle> listarPorSuscripcion(Long idSuscripcion) {
        List<?> filas = em.createQuery("""
                        select m, p
                        from MiembroSuscripcionEntity m, PersonaEntity p
                        where m.idPersona = p.idPersona and m.idSuscripcion = :idSuscripcion
                        order by m.estado, p.apellidos, p.nombres, m.idMiembro
                        """)
                .setParameter("idSuscripcion", idSuscripcion)
                .getResultList();
        List<MiembroDetalle> resultado = new ArrayList<>();
        for (Object fila : filas) {
            Object[] columnas = (Object[]) fila;
            MiembroSuscripcion miembro = mapper.aDominio((MiembroSuscripcionEntity) columnas[0]);
            PersonaEntity persona = (PersonaEntity) columnas[1];
            resultado.add(new MiembroDetalle(miembro, persona.getNombres(), persona.getApellidos(),
                    persona.getDocumento()));
        }
        return resultado;
    }
}
