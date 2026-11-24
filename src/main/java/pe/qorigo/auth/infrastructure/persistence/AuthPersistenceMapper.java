package pe.qorigo.auth.infrastructure.persistence;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.auth.domain.RecuperacionPassword;
import pe.qorigo.auth.domain.Rol;
import pe.qorigo.auth.domain.Usuario;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface AuthPersistenceMapper {

    Usuario aDominio(UsuarioEntity entity);

    UsuarioEntity aEntidad(Usuario usuario);

    RecuperacionPassword aDominio(RecuperacionPasswordEntity entity);

    RecuperacionPasswordEntity aEntidad(RecuperacionPassword recuperacion);

    default String aTexto(Rol rol) {
        return rol == null ? null : rol.name();
    }

    default Rol aRol(String valor) {
        return valor == null ? null : Rol.valueOf(valor);
    }
}
