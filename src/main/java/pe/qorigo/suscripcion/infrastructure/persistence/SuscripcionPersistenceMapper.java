package pe.qorigo.suscripcion.infrastructure.persistence;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.suscripcion.domain.EstadoSuscripcion;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface SuscripcionPersistenceMapper {

    Suscripcion aDominio(SuscripcionEntity entity);

    SuscripcionEntity aEntidad(Suscripcion suscripcion);

    List<Suscripcion> aDominio(List<SuscripcionEntity> entities);

    default String aTexto(EstadoSuscripcion estado) {
        return estado == null ? null : estado.name();
    }

    default EstadoSuscripcion aEstado(String estado) {
        return estado == null ? null : EstadoSuscripcion.valueOf(estado);
    }
}
