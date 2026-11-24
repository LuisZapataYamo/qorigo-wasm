package pe.qorigo.suscripcion.infrastructure.persistence;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import pe.qorigo.shared.application.Pagina;
import pe.qorigo.suscripcion.application.FiltroSuscripciones;
import pe.qorigo.suscripcion.application.ResumenMiembros;
import pe.qorigo.suscripcion.application.SuscripcionRepository;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class SuscripcionPersistenceAdapter implements SuscripcionRepository {

    @Inject
    EntityManager em;

    @Inject
    SuscripcionPersistenceMapper mapper;

    @Override
    public Suscripcion guardar(Suscripcion suscripcion) {
        SuscripcionEntity entity = mapper.aEntidad(suscripcion);
        if (entity.getIdSuscripcion() == null) {
            em.persist(entity);
        } else {
            entity = em.merge(entity);
        }
        em.flush();
        return mapper.aDominio(entity);
    }

    @Override
    public Optional<Suscripcion> buscarPorId(Long idSuscripcion) {
        return Optional.ofNullable(em.find(SuscripcionEntity.class, idSuscripcion)).map(mapper::aDominio);
    }

    @Override
    public Optional<Suscripcion> bloquearPorId(Long idSuscripcion) {
        return Optional.ofNullable(em.find(SuscripcionEntity.class, idSuscripcion,
                        jakarta.persistence.LockModeType.PESSIMISTIC_WRITE))
                .map(mapper::aDominio);
    }

    @Override
    public Pagina<Suscripcion> buscar(FiltroSuscripciones filtro) {
        StringBuilder condiciones = new StringBuilder();
        if (filtro.texto() != null) {
            condiciones.append(" and lower(s.nombre) like :textoLike");
        }
        if (filtro.estado() != null) {
            condiciones.append(" and s.estado = :estado");
        }
        if (filtro.idPlataforma() != null) {
            condiciones.append(" and s.idPlataforma = :idPlataforma");
        }

        Query consulta = em.createQuery(
                "select s from SuscripcionEntity s where 1 = 1" + condiciones +
                        " order by s.nombre, s.idSuscripcion",
                SuscripcionEntity.class);
        Query conteo = em.createQuery(
                "select count(s) from SuscripcionEntity s where 1 = 1" + condiciones,
                Long.class);
        aplicarParametros(consulta, filtro);
        aplicarParametros(conteo, filtro);

        @SuppressWarnings("unchecked")
        List<SuscripcionEntity> entidades = consulta
                .setFirstResult(filtro.desplazamiento())
                .setMaxResults(filtro.tamano())
                .getResultList();
        long total = (Long) conteo.getSingleResult();
        return Pagina.de(mapper.aDominio(entidades), filtro.pagina(), filtro.tamano(), total);
    }

    @Override
    public ResumenMiembros resumenMiembros(Long idSuscripcion) {
        Object[] fila = (Object[]) em.createQuery("""
                        select count(m), coalesce(sum(m.montoAcordado), 0)
                        from MiembroSuscripcionEntity m
                        where m.idSuscripcion = :idSuscripcion and m.estado = 'ACTIVO'
                        """)
                .setParameter("idSuscripcion", idSuscripcion)
                .getSingleResult();
        return new ResumenMiembros(((Number) fila[0]).longValue(), aDecimal(fila[1]));
    }

    @Override
    public Map<Long, ResumenMiembros> resumenMiembros(Collection<Long> idsSuscripcion) {
        if (idsSuscripcion == null || idsSuscripcion.isEmpty()) {
            return Map.of();
        }
        List<?> filas = em.createQuery("""
                        select m.idSuscripcion, count(m), coalesce(sum(m.montoAcordado), 0)
                        from MiembroSuscripcionEntity m
                        where m.idSuscripcion in :ids and m.estado = 'ACTIVO'
                        group by m.idSuscripcion
                        """)
                .setParameter("ids", idsSuscripcion)
                .getResultList();
        Map<Long, ResumenMiembros> resumenes = new LinkedHashMap<>();
        for (Object fila : filas) {
            Object[] columnas = (Object[]) fila;
            resumenes.put(((Number) columnas[0]).longValue(),
                    new ResumenMiembros(((Number) columnas[1]).longValue(), aDecimal(columnas[2])));
        }
        return resumenes;
    }

    private void aplicarParametros(Query query, FiltroSuscripciones filtro) {
        if (filtro.texto() != null) {
            query.setParameter("textoLike", "%" + filtro.texto().toLowerCase(Locale.ROOT) + "%");
        }
        if (filtro.estado() != null) {
            query.setParameter("estado", filtro.estado().name());
        }
        if (filtro.idPlataforma() != null) {
            query.setParameter("idPlataforma", filtro.idPlataforma());
        }
    }

    private BigDecimal aDecimal(Object valor) {
        if (valor == null) {
            return BigDecimal.ZERO;
        }
        if (valor instanceof BigDecimal decimal) {
            return decimal;
        }
        return new BigDecimal(valor.toString());
    }
}
