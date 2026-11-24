package pe.qorigo.catalogo.infrastructure.persistence;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.catalogo.domain.Moneda;
import pe.qorigo.catalogo.domain.Plataforma;

import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface CatalogoPersistenceMapper {

    Plataforma aDominio(PlataformaEntity entity);

    PlataformaEntity aEntidad(Plataforma plataforma);

    List<Plataforma> aPlataformas(List<PlataformaEntity> entities);

    Moneda aDominio(MonedaEntity entity);

    List<Moneda> aMonedas(List<MonedaEntity> entities);
}
