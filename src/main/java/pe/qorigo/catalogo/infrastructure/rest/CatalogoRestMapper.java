package pe.qorigo.catalogo.infrastructure.rest;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.catalogo.domain.Moneda;
import pe.qorigo.catalogo.domain.Plataforma;

import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface CatalogoRestMapper {

    PlataformaResponse aResponse(Plataforma plataforma);

    List<PlataformaResponse> aPlataformaResponses(List<Plataforma> plataformas);

    MonedaResponse aResponse(Moneda moneda);

    List<MonedaResponse> aMonedaResponses(List<Moneda> monedas);
}
