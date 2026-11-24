package pe.qorigo.catalogo.infrastructure.persistence;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import pe.qorigo.catalogo.application.CatalogoRepository;
import pe.qorigo.catalogo.domain.Moneda;
import pe.qorigo.catalogo.domain.Plataforma;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class CatalogoPersistenceAdapter implements CatalogoRepository {

    @Inject
    EntityManager em;

    @Inject
    CatalogoPersistenceMapper mapper;

    @Override
    public List<Plataforma> plataformas(boolean soloActivas) {
        String jpql = "select p from PlataformaEntity p" +
                (soloActivas ? " where p.activo = true" : "") +
                " order by p.nombre";
        return mapper.aPlataformas(em.createQuery(jpql, PlataformaEntity.class).getResultList());
    }

    @Override
    public Optional<Plataforma> buscarPlataforma(Long idPlataforma) {
        return Optional.ofNullable(em.find(PlataformaEntity.class, idPlataforma)).map(mapper::aDominio);
    }

    @Override
    public Optional<Plataforma> buscarPlataformaPorNombre(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            return Optional.empty();
        }
        return em.createQuery("select p from PlataformaEntity p where lower(p.nombre) = lower(:nombre)",
                        PlataformaEntity.class)
                .setParameter("nombre", nombre.trim())
                .getResultStream()
                .findFirst()
                .map(mapper::aDominio);
    }

    @Override
    public Plataforma guardarPlataforma(Plataforma plataforma) {
        PlataformaEntity entity = mapper.aEntidad(plataforma);
        if (entity.getIdPlataforma() == null) {
            em.persist(entity);
        } else {
            entity = em.merge(entity);
        }
        em.flush();
        return mapper.aDominio(entity);
    }

    @Override
    public List<Moneda> monedas() {
        return mapper.aMonedas(em.createQuery("select m from MonedaEntity m order by m.codigo", MonedaEntity.class)
                .getResultList());
    }

    @Override
    public boolean existeMoneda(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            return false;
        }
        Long total = em.createQuery("select count(m) from MonedaEntity m where m.codigo = :codigo", Long.class)
                .setParameter("codigo", codigo.trim().toUpperCase())
                .getSingleResult();
        return total > 0;
    }

    @Override
    public Map<String, String> configuracion() {
        List<ConfiguracionEntity> filas = em.createQuery(
                        "select c from ConfiguracionEntity c order by c.clave", ConfiguracionEntity.class)
                .getResultList();
        Map<String, String> valores = new LinkedHashMap<>();
        for (ConfiguracionEntity fila : filas) {
            valores.put(fila.getClave(), fila.getValor());
        }
        return valores;
    }

    @Override
    public void actualizarConfiguracion(Map<String, String> valores) {
        for (Map.Entry<String, String> entrada : valores.entrySet()) {
            ConfiguracionEntity entity = em.find(ConfiguracionEntity.class, entrada.getKey());
            if (entity == null) {
                entity = new ConfiguracionEntity();
                entity.setClave(entrada.getKey());
                entity.setValor(entrada.getValue());
                em.persist(entity);
            } else {
                entity.setValor(entrada.getValue());
            }
        }
        em.flush();
    }
}
