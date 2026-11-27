package com.boa.apid.core.auth.service;

import com.boa.apid.core.auth.config.LdapProperties;
import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.organization.service.DepartmentCacheInvalidationEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.query.LdapQuery;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class ActiveDirectorySyncServiceTest {

    @Mock
    private LdapTemplate ldapTemplate;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    private ActiveDirectorySyncService syncService;

    @BeforeEach
    void setUp() {
        LdapProperties ldapProperties = new LdapProperties();
        ldapProperties.setEnabled(true);
        syncService = new ActiveDirectorySyncService(
                ldapProperties,
                ldapTemplate,
                userRepository,
                employeeRepository,
                departmentRepository,
                eventPublisher,
                roleRepository,
                userRoleRepository
        );
    }

    @Test
    void syncAllAssignsEmployeeToMappedDepartmentForAdLocation() {
        Department district = department(1L, "DST-001", "Central District", null);
        Department branch = department(2L, "BR-001", "Addis Kazanchis", null);
        Employee employee = employee(department(3L, "HQ-001", "Head Office", null));

        var result = sync(
                record("Addis Kazanchis", "DST-001", "BR-001"),
                employee,
                List.of(district, branch, employee.getDepartment())
        );

        assertThat(result.success()).isTrue();
        assertThat(employee.getDepartment()).isSameAs(branch);
        assertThat(branch.getParentDepartment()).isSameAs(district);
    }

    @Test
    void syncAllPreservesExistingDepartmentWhenAdLocationCannotBeResolved() {
        Department existingDepartment = department(3L, "HQ-001", "Head Office", null);
        Employee employee = employee(existingDepartment);

        var result = sync(recordWithoutLocation(), employee, List.of(existingDepartment));

        assertThat(result.success()).isTrue();
        assertThat(employee.getDepartment()).isSameAs(existingDepartment);
        assertThat(employee.getDepartmentName()).isEqualTo("Head Office");
    }

    @Test
    void syncAllCreatesAndAssignsDistrictAndBranchDepartmentsFromAd() {
        var districtDirector = new ActiveDirectorySyncService.AdSyncUserRecord(
                "CN=District Director,OU=Central,DC=apid,DC=test",
                "district001",
                "district001@apid.test",
                "00020026",
                "district001@apid.test",
                "District Director",
                "District",
                "Director",
                "Central District",
                "Central District",
                "DST-001",
                null,
                "District Director",
                null,
                0,
                List.of()
        );
        var branchEmployee = record("Addis Kazanchis", "DST-001", "BR-001");
        var departmentEmployee = new ActiveDirectorySyncService.AdSyncUserRecord(
                "CN=Operations Officer,OU=Central,DC=apid,DC=test",
                "operations001",
                "operations001@apid.test",
                "00020032",
                "operations001@apid.test",
                "Operations Officer",
                "Operations",
                "Officer",
                "Operations",
                "Central Operations",
                "DST-001",
                null,
                "Operations Officer",
                null,
                0,
                List.of()
        );
        Map<String, Employee> savedEmployees = new HashMap<>();
        Map<String, Department> savedDepartments = new HashMap<>();
        AtomicLong userIds = new AtomicLong(100L);
        AtomicLong employeeIds = new AtomicLong(200L);
        AtomicLong departmentIds = new AtomicLong(300L);

        when(ldapTemplate.<ActiveDirectorySyncService.AdSyncUserRecord>search(
                any(LdapQuery.class),
                ArgumentMatchers.<ContextMapper<ActiveDirectorySyncService.AdSyncUserRecord>>any()
        ))
                .thenReturn(List.of(districtDirector, branchEmployee, departmentEmployee));
        when(userRepository.findByUsernameLowerForUpdate(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(userIds.getAndIncrement());
            return user;
        });
        when(employeeRepository.findByEmployeeNumberIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(employeeRepository.save(any(Employee.class))).thenAnswer(invocation -> {
            Employee employee = invocation.getArgument(0);
            employee.setId(employeeIds.getAndIncrement());
            savedEmployees.put(employee.getEmployeeNumber(), employee);
            return employee;
        });
        when(departmentRepository.findAllByOrderByNameAsc()).thenReturn(List.of());
        when(departmentRepository.save(any(Department.class))).thenAnswer(invocation -> {
            Department department = invocation.getArgument(0);
            department.setId(departmentIds.getAndIncrement());
            savedDepartments.put(department.getCode(), department);
            return department;
        });
        when(roleRepository.findAll()).thenReturn(List.of());

        var result = syncService.syncAll();

        Department district = savedDepartments.get("DST-001");
        Department branch = savedDepartments.get("BR-001");
        Department department = savedEmployees.get("00020032").getDepartment();
        assertThat(result.success()).isTrue();
        assertThat(district).isNotNull();
        assertThat(branch).isNotNull();
        assertThat(branch.getParentDepartment()).isSameAs(district);
        assertThat(department.getName()).isEqualTo("Operations");
        assertThat(department.getParentDepartment()).isSameAs(district);
        assertThat(savedEmployees.get("00020026").getDepartment()).isSameAs(district);
        assertThat(savedEmployees.get("00020031").getDepartment()).isSameAs(branch);
        assertThat(savedEmployees.get("00020032").getDepartment()).isSameAs(department);
        verify(eventPublisher).publishEvent(any(DepartmentCacheInvalidationEvent.class));
    }

    private ActiveDirectorySyncService.AdSyncResult sync(
            ActiveDirectorySyncService.AdSyncUserRecord adUser,
            Employee employee,
            List<Department> departments
    ) {
        User user = new User();
        user.setId(10L);
        user.setUsername("test0001");
        user.setAuthProvider(AuthProvider.ACTIVE_DIRECTORY);
        user.setStatus(UserStatus.ACTIVE);

        when(ldapTemplate.<ActiveDirectorySyncService.AdSyncUserRecord>search(
                any(LdapQuery.class),
                ArgumentMatchers.<ContextMapper<ActiveDirectorySyncService.AdSyncUserRecord>>any()
        )).thenReturn(List.of(adUser));
        when(userRepository.findByUsernameLowerForUpdate("test0001")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(employeeRepository.findByEmployeeNumberIgnoreCase("00020031")).thenReturn(Optional.of(employee));
        when(employeeRepository.save(any(Employee.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(departmentRepository.findAllByOrderByNameAsc()).thenReturn(departments);
        AtomicLong departmentIds = new AtomicLong(100L);
        lenient().when(departmentRepository.save(any(Department.class))).thenAnswer(invocation -> {
            Department department = invocation.getArgument(0);
            if (department.getId() == null) {
                department.setId(departmentIds.getAndIncrement());
            }
            return department;
        });
        when(roleRepository.findAll()).thenReturn(List.of());

        return syncService.syncAll();
    }

    private ActiveDirectorySyncService.AdSyncUserRecord recordWithoutLocation() {
        return new ActiveDirectorySyncService.AdSyncUserRecord(
                "CN=Test User,OU=APID,DC=apid,DC=test",
                "test0001",
                "test0001@apid.test",
                "00020031",
                "test0001@apid.test",
                "Test User",
                "Test",
                "User",
                null,
                null,
                null,
                null,
                "Employee",
                null,
                0,
                List.of()
        );
    }

    private ActiveDirectorySyncService.AdSyncUserRecord record(
            String office,
            String districtId,
            String branchId
    ) {
        return new ActiveDirectorySyncService.AdSyncUserRecord(
                "CN=Test User,OU=APID,DC=apid,DC=test",
                "test0001",
                "test0001@apid.test",
                "00020031",
                "test0001@apid.test",
                "Test User",
                "Test",
                "User",
                "Branch Operations",
                office,
                districtId,
                branchId,
                "Branch Employee",
                null,
                0,
                List.of()
        );
    }

    private Department department(Long id, String code, String name, Department parent) {
        Department department = new Department();
        department.setId(id);
        department.setCode(code);
        department.setName(name);
        department.setParentDepartment(parent);
        return department;
    }

    private Employee employee(Department department) {
        Employee employee = new Employee();
        employee.setId(20L);
        employee.setEmployeeNumber("00020031");
        employee.setFullName("Existing Employee");
        employee.setDepartment(department);
        employee.setDepartmentName(department.getName());
        employee.setParentDepartmentName(
                department.getParentDepartment() != null ? department.getParentDepartment().getName() : null
        );
        return employee;
    }
}
