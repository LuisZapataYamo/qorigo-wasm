package pe.qorigo.support;

import at.favre.lib.crypto.bcrypt.BCrypt;
import io.agroal.api.AgroalDataSource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import pe.qorigo.persona.domain.NombreNormalizador;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class TestDb {

    public static final String ADMIN_EMAIL = "admin@qorigo.local";
    public static final String ADMIN_PASSWORD = "Admin123!";

    private static final String[] TABLAS = {
            "comprobante_pago", "aplicacion_pago", "pago", "cuota_ajuste", "cuota_prestamo",
            "prestamo", "cargo_suscripcion", "costo_suscripcion_periodo", "miembro_suscripcion",
            "suscripcion", "recuperacion_password", "auditoria", "usuario", "persona"
    };

    @Inject
    AgroalDataSource dataSource;

    private Long idAdmin;

    public void reiniciar() {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(true);
            try (Statement statement = connection.createStatement()) {
                for (String tabla : TABLAS) {
                    statement.executeUpdate("DELETE FROM " + tabla);
                }
                statement.executeUpdate("DELETE FROM plataforma WHERE nombre NOT IN ('YouTube', 'Microsoft', 'Obsidian')");
                statement.executeUpdate("UPDATE plataforma SET activo = TRUE WHERE nombre IN ('YouTube', 'Microsoft', 'Obsidian')");
                statement.executeUpdate("DELETE FROM configuracion");
                statement.executeUpdate("INSERT INTO configuracion (clave, valor) VALUES ('umbral_riesgo_dias', '30')");
                statement.executeUpdate("INSERT INTO configuracion (clave, valor) VALUES ('imagen_ancho', '100')");
                statement.executeUpdate("INSERT INTO configuracion (clave, valor) VALUES ('imagen_alto', '100')");
                statement.executeUpdate("INSERT INTO configuracion (clave, valor) VALUES ('metodos_con_comprobante', 'YAPE,PLIN,TRANSFERENCIA')");
            }
            idAdmin = insertarAdmin(connection);
        } catch (SQLException e) {
            throw new IllegalStateException("No se pudo reiniciar la base de pruebas", e);
        }
    }

    private Long insertarAdmin(Connection connection) throws SQLException {
        Long idPersona = insertarPersona(connection, "Administrador", "QoriGo", null, ADMIN_EMAIL);
        String hash = BCrypt.withDefaults().hashToString(10, ADMIN_PASSWORD.toCharArray());
        String sql = "INSERT INTO usuario (id_persona, email_login, password_hash, rol, activo, creado_en) " +
                "VALUES (?, ?, ?, 'ADMIN', TRUE, CURRENT_TIMESTAMP)";
        try (PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, idPersona);
            ps.setString(2, ADMIN_EMAIL);
            ps.setString(3, hash);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        }
    }

    public Long idAdmin() {
        return idAdmin;
    }

    public Long crearPersona(String nombres, String apellidos, String documento, String email) {
        try (Connection connection = dataSource.getConnection()) {
            return insertarPersona(connection, nombres, apellidos, documento, email);
        } catch (SQLException e) {
            throw new IllegalStateException("No se pudo crear la persona de prueba", e);
        }
    }

    private Long insertarPersona(Connection connection, String nombres, String apellidos, String documento, String email)
            throws SQLException {
        String sql = "INSERT INTO persona (nombres, apellidos, nombre_normalizado, documento, email, activo, creado_en) " +
                "VALUES (?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)";
        try (PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, nombres);
            ps.setString(2, apellidos);
            ps.setString(3, NombreNormalizador.nombreCompleto(nombres, apellidos));
            ps.setString(4, documento);
            ps.setString(5, email);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        }
    }

    public void ejecutar(String sql, Object... parametros) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(sql)) {
            for (int i = 0; i < parametros.length; i++) {
                ps.setObject(i + 1, parametros[i]);
            }
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Error ejecutando SQL de prueba: " + sql, e);
        }
    }

    public long contar(String sql, Object... parametros) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(sql)) {
            for (int i = 0; i < parametros.length; i++) {
                ps.setObject(i + 1, parametros[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong(1);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Error contando en SQL de prueba: " + sql, e);
        }
    }

    public Map<String, Object> unico(String sql, Object... parametros) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(sql)) {
            for (int i = 0; i < parametros.length; i++) {
                ps.setObject(i + 1, parametros[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Map<String, Object> fila = new LinkedHashMap<>();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
                    fila.put(rs.getMetaData().getColumnLabel(i).toLowerCase(), rs.getObject(i));
                }
                return fila;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Error consultando en SQL de prueba: " + sql, e);
        }
    }

    public List<Map<String, Object>> filas(String sql, Object... parametros) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(sql)) {
            for (int i = 0; i < parametros.length; i++) {
                ps.setObject(i + 1, parametros[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                List<Map<String, Object>> resultado = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> fila = new LinkedHashMap<>();
                    for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
                        fila.put(rs.getMetaData().getColumnLabel(i).toLowerCase(), rs.getObject(i));
                    }
                    resultado.add(fila);
                }
                return resultado;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Error consultando en SQL de prueba: " + sql, e);
        }
    }
}
