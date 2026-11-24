package pe.qorigo.suscripcion.infrastructure.persistence;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.suscripcion.domain.EstadoMiembro;
import pe.qorigo.suscripcion.domain.MiembroSuscripcion;

import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface MiembroSuscripcionPersistenceMapper {

    MiembroSuscripcion aDominio(MiembroSuscripcionEntity entity);

    MiembroSuscripcionEntity aEntidad(MiembroSuscripcion miembro);

    List<MiembroSuscripcion> aDominio(List<MiembroSuscripcionEntity> entities);

    default String aTexto(EstadoMiembro estado) {
        return estado == null ? null : estado.name();
    }

    default EstadoMiembro aEstado(String estado) {
        return estado == null ? null : EstadoMiembro.valueOf(estado);
    }
}
