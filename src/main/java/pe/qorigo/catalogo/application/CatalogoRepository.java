package pe.qorigo.catalogo.application;

import pe.qorigo.catalogo.domain.Moneda;
import pe.qorigo.catalogo.domain.Plataforma;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface CatalogoRepository {

    List<Plataforma> plataformas(boolean soloActivas);

    Optional<Plataforma> buscarPlataforma(Long idPlataforma);

    Optional<Plataforma> buscarPlataformaPorNombre(String nombre);

    Plataforma guardarPlataforma(Plataforma plataforma);

    List<Moneda> monedas();

    boolean existeMoneda(String codigo);

    Map<String, String> configuracion();

    void actualizarConfiguracion(Map<String, String> valores);
}
