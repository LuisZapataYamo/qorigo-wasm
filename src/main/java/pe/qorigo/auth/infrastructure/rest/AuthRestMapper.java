package pe.qorigo.auth.infrastructure.rest;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.auth.application.SesionIniciada;
import pe.qorigo.auth.application.UsuarioSesion;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface AuthRestMapper {

    UsuarioResponse aResponse(UsuarioSesion usuario);

    default LoginResponse aResponse(SesionIniciada sesion) {
        return new LoginResponse(sesion.token(), sesion.expiraEn(), aResponse(sesion.usuario()));
    }
}
