package pe.qorigo.persona.infrastructure.rest;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.persona.application.RegistrarPersonaCommand;
import pe.qorigo.persona.domain.Persona;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface PersonaRestMapper {

    PersonaResponse aResponse(Persona persona);

    default RegistrarPersonaCommand aCommand(CrearPersonaRequest request) {
        return new RegistrarPersonaCommand(
                request.nombres(),
                request.apellidos(),
                request.documento(),
                request.telefono(),
                request.email(),
                request.direccion(),
                request.confirmaDuplicado());
    }
}
