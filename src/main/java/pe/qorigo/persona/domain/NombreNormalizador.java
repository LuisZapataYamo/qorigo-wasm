package pe.qorigo.persona.domain;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Normaliza nombres para búsquedas y detección de duplicados: sin tildes, en
 * minúsculas y con espacios simples.
 */
public final class NombreNormalizador {

    private NombreNormalizador() {
    }

    public static String normalizar(String valor) {
        if (valor == null) {
            return "";
        }
        String sinTildes = Normalizer.normalize(valor, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return Arrays.stream(sinTildes.toLowerCase(Locale.ROOT).trim().split("\\s+"))
                .filter(parte -> !parte.isBlank())
                .collect(Collectors.joining(" "));
    }

    public static String nombreCompleto(String nombres, String apellidos) {
        return normalizar(nombres + " " + apellidos);
    }
}
