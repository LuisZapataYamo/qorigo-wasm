package pe.qorigo.persona.infrastructure.persistence;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import pe.qorigo.persona.domain.Persona;

import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.CDI)
public interface PersonaPersistenceMapper {

    Persona aDominio(PersonaEntity entity);

    PersonaEntity aEntidad(Persona persona);

    List<Persona> aDominio(List<PersonaEntity> entities);
}
